import {
  IDefaultObject,
  IDefinitionVirtualProperty,
  IPathVirtualParameter,
  IPathVirtualProperty,
  ISwaggerContent,
  ISwaggerOptions,
  ISwaggerResultPath,
} from "./swagger.ts";
import { getRefType, hasKey, lowerCase, upperCamelCase, upperCase } from './util.ts'
import Logs from "./console.ts";
import { getT } from "./i18n/index.ts";

/**
 * 从 URL 获取方法名称
 * @param url - 接口地址
 * @param space  - 连接字符
 * @returns
 */
const getMethodName = (url: string, space = "by") => {
  // 排除URL路径中有Query参数
  const _url = url.split("?")[0]?.split("/");
  let _name = _url.pop() as string

  const regExp = /^{(\w+)}$/
  if (regExp.test(_name)) {
    // 动态路径添加连接字符
    _name = _url.pop() + `_${space}_` + _name.match(regExp)![1]
    _name = _name.toLowerCase()
  }

  // _-命名转换未首字符大写风格驼峰命名
  return upperCamelCase(_name)
};

/**
 * ApiFox 属性（type 为 object 时，处理存在的属性定义）
 * @param properties - 属性
 * @param requiredProps - 必填属性
 * @returns
 */
const getProperties = (
  properties: IDefaultObject<IDefinitionVirtualProperty>,
  requiredProps: string[],
) => {
  const _properties = Object.keys(properties ?? {})
    .reduce((prev: IDefinitionVirtualProperty[], current) => {
      const _props = properties[current];

      const _propItem: IDefinitionVirtualProperty = {
        name: current,
        type: _props?.type ?? "",
        typeX: _props.items?.type,
        required: requiredProps.includes(current) ??
          false,
        title: _props?.title,
        description: _props?.description ?? "",
        // ref: getRefType(
        //   _props?.$ref ?? _props?.items?.$ref ?? "",
        // ),
      };

      // 处理 properties
      if (hasKey(_props as unknown as Record<string, unknown>, "properties")) {
        _propItem.properties = getProperties(
          (_props.properties) as unknown as IDefaultObject<
            IDefinitionVirtualProperty
          >,
          (_props?.required ?? []) as unknown as string[],
        );
      }

      // 处理 items
      if (hasKey(_props as unknown as Record<string, unknown>, "items")) {
        // 检查 items 是否为 object
        if (
          hasKey(
            _props.items as unknown as Record<string, unknown>,
            "properties",
          )
        ) {
          _propItem.properties = getProperties(
            (_props.items?.properties) as unknown as IDefaultObject<
              IDefinitionVirtualProperty
            >,
            (_props.items?.required ?? []) as unknown as string[],
          );
        }
      }

      prev.push(_propItem);
      return prev;
    }, []);

  return _properties;
};

/**
 * 获取请求对象
 * @param url - 接口地址
 * @param method - 请求方式
 * @param pathMethod - 请求对象
 * @param tagIndex - 从 url 指定标签
 * @returns
 */
const getPathVirtualProperty = (
  url: string,
  method: string,
  pathMethod: ISwaggerResultPath,
  tagIndex?: number,
): IPathVirtualProperty => {
  // 请求参数 path、query、body、formData、header
  const parameters =
    (pathMethod.parameters?.sort((_a, _b) =>
      Number(_b.required) - Number(_a.required)
    ) ?? []).reduce((prev: IPathVirtualParameter, current) => {
      const _schema = current.schema;
      const item: IDefinitionVirtualProperty = {
        name: current.name,
        type: current.type ?? _schema?.type ?? "",
        required: current.required,
        description: current.description,
        format: current.format ?? _schema?.format,
        ref: getRefType(
          _schema?.$ref ?? _schema?.items?.$ref ?? "",
        ),
        typeX: current?.items?.type ?? _schema?.items?.type,
      };

      prev[current.in].push(item);

      return prev;
    }, { path: [], query: [], body: [], formData: [], header: [] });

  // v3 body 参数在 requestBody
  const _requestBody = pathMethod.requestBody;
  if (_requestBody) {
    Object.keys(_requestBody.content).forEach((_key) => {
      if (["application/json", "application/octet-stream"].includes(_key)) {
        const _bodyContent =
          _requestBody.content[_key as keyof ISwaggerContent];
        const _bodyContentSchema = _bodyContent?.schema;
        const _bodyContentRef = getRefType(
          _bodyContentSchema?.$ref ?? _bodyContentSchema?.items?.$ref ?? "",
        );
        const _name = _key === "application/octet-stream"
          ? "file"
          : lowerCase(_bodyContentRef);

        // 处理 type 为 object 的情况，并且有 properties 属性
        const _properties = getProperties(
          _bodyContentSchema?.properties ?? {},
          _bodyContentSchema?.required ?? [],
        );

        const _body: IDefinitionVirtualProperty = {
          name: _name || "body",
          type: _bodyContentSchema?.type ?? "",
          required: _requestBody.required ?? true,
          description: _requestBody.description,
          ref: _bodyContentRef,
          properties: _properties,
        };

        parameters.body.push(_body);
      }
    });
  }

  // 响应
  const _resSchema = pathMethod.responses[200]?.schema ??
    pathMethod.responses[200]?.content?.["application/json"]?.schema;

  const _properties = getProperties(
    _resSchema?.properties ?? {},
    _resSchema?.required ?? [],
  );

  // 标签，用于文件名
  let _tag = pathMethod.tags?.[0];
  if (tagIndex !== undefined) {
    _tag = url.split("/")[tagIndex];
  }

  const value: IPathVirtualProperty = {
    url,
    method,
    parameters,
    requestHeaders: pathMethod.consumes,
    responseHeaders: pathMethod.produces,
    response: {
      ref: getRefType(_resSchema?.$ref ?? _resSchema?.items?.$ref ?? ""),
      type: _resSchema?.type,
      properties: _properties,
    },
    summary: pathMethod.summary,
    description: pathMethod.description,
    tag: _tag,
  };

  return value;
};

const parserFilter = (filters: string[]) => {
  if (!filters.length) return undefined;

  const regStr = filters.reduce((prev, current) => {
    const _str = current.replace(/\//g, "\\/").replace(/\*/g, ".*");

    return `${prev ? `${prev}|` : ""}(${_str})`;
  }, "");

  return new RegExp(regStr);
};

/**
 * 获取接口地址对象
 * @param paths - 接口地址
 * @returns
 */
export const getApiPath = (
  paths: IDefaultObject<IDefaultObject<ISwaggerResultPath>>,
  options?: ISwaggerOptions,
): Map<string, IPathVirtualProperty> => {
  const pathMap = new Map<string, IPathVirtualProperty>();

  Object.keys(paths).forEach((url) => {
    // 过滤接口，符合过滤条件的接口会被生成
    if (options?.filter?.length && !parserFilter(options.filter)?.test(url)) {
      return;
    }

    // 请求方式
    const methods = paths[url];

    Object.keys(methods).forEach((method) => {
      const currentMethod = methods[method];
      // 方法名
      let name = currentMethod.operationId ?? getMethodName(url, options?.con);
      if (!name) {
        Logs.error(getT("$t(path.notName)", { url, method }));
        return;
      }

      // 判断添加请求方式标识
      if (options?.addMethod) {
        name = `${upperCase(method)}${name}`;
      }

      // 接口对象
      const value = getPathVirtualProperty(
        url,
        method,
        currentMethod,
        options?.tag,
      );

      pathMap.set(name, value);
    });
  });

  return pathMap;
};
