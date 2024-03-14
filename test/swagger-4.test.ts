// https://petstore3.swagger.io/api/v3/openapi.json
import { assertEquals } from "std/assert/mod.ts";

Deno.test("测试 解决动态路径生成方法被覆盖的问题", async () => {
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "src/main.ts",
      "--url=https://api.swaggerhub.com/apis/frezs/wp-json/1.0.0",
      "--outDir=out",
    ],
  });

  const { code } = await command.output();

  assertEquals(0, code);
});

Deno.test("测试 解决URL路径中有Query参数方法名称生成错误的问题", async () => {
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "src/main.ts",
      "--url=https://api.swaggerhub.com/apis/frezs/blog-json/1.0.0",
      "--outDir=out",
    ],
  });

  const { code } = await command.output();

  assertEquals(0, code);
});
