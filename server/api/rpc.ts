import { H3Event, readBody } from "h3";
import { getAccess } from "../access/access";

export interface RPCRequest {
  method?: string;
  body: {
    method: string;
    params: string[];
  };
  query?: any;
}

function getMethodName(req: RPCRequest) {
  if (req.method === "POST") {
    return req.body.method;
  }

  if (req.method === "GET") {
    for (const prop in req.query) {
      return req.query[prop]; // Method name is the first property
    }
  }
  return null;
}

function getMethodParams(req: RPCRequest) {
  if (req.method === "POST") {
    return req.body.params;
  }

  if (req.method === "GET") {
    const res = [];
    let i = 0;

    if (!req.query) return [];

    for (const prop in req.query) {
      if (i !== 0)
        // Method name is the first property so we skip it
        res.push(req.query[prop]);
      i++;
    }
    return res;
  }
  return null;
}

async function execRpc(acc: any, methodName: string, ...args: any) {
  if (!methodName) {
    return {
      error: 11,
      message: "Unknown method",
    };
  }

  if (methodName.startsWith("private")) {
    return {
      error: 11,
      message: "Trying to invocate a private method",
    };
  }

  const met = acc[methodName];
  if (typeof met != "function") {
    return {
      error: 2,
      message: "Authentication error",
    };
  }

  let result = await acc[methodName](...args);
  if (result === undefined) result = null;
  if (methodName.includes("obf_") && result != null) {
    let newResult = {
      obfuscated: true,
      data: Buffer.from(JSON.stringify(result)).toString("base64"),
      version: result.version,
    };
    return newResult;
  } else {
    return result;
  }
}

async function rpc(event: H3Event) {
  try {
    let body = null;
    if (event.node.req.method?.toUpperCase() == "POST") {
      try {
        body = await readBody(event);
      } catch {
        body = null;
      }
    }

    let query = getQuery(event);
    let req: RPCRequest = {
      method: event.node.req.method,
      body: body,
      query: query,
    };

    if (req.method === "POST") {
      if (!req.body) {
        return {
          error: 1,
          message: "Undefined body",
        };
      }

      if (!req.body.method) {
        return {
          error: 1,
          message: "No method provided",
        };
      }
    }

    const acc = getAccess(event, req);
    const methodName = getMethodName(req);
    const args = getMethodParams(req) || [];

    let result = await execRpc(acc, methodName, ...args);
    return JSON.stringify(result);
  } catch (error: any) {
    console.error(error);
    return {
      error: 10,
      message: error.message,
    };
  }
}

export default defineEventHandler(async (event) => {
  let res = await rpc(event);

  console.log(event.context.session);
  return res;
});
