import type CAccessNc from "../../server/access/access_nc";

export type rpcKeys = CAccessNc;
export type rpcFunction<FKey extends keyof rpcKeys> = rpcKeys[FKey];

function toQuery(data: any) {
  let res = "";
  let i = 0;
  let replaceChar = "?";

  for (const key of data) {
    if (i !== 0) replaceChar = "&";
    res += replaceChar + "p" + i + "=" + key;
    i++;
  }
  return res;
}

function unobfuscate(json: any) {
  if (json != null && json.obfuscated) {
    let data = JSON.parse(Buffer.from(json.data, "base64").toString());
    return data;
  } else {
    return json;
  }
}

export async function rpc<FKey extends keyof rpcKeys>(
  funcname: FKey,
  ...args: any[]
): Promise<any> {
  const method = funcname;
  const data = {
    method,
    params: args,
  };

  const res = await fetch("/api/rpc", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(data),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("New Recruit may be under maintenance");
  }

  let text = await res.text();
  // Nitro seems to return nothing instead of null when a method returns null
  if (text.length == 0) {
    text = "null";
  }
  const json = JSON.parse(text);
  if (json != null && json.error) {
    json.method = method;
    throw new Error(JSON.stringify(json));
  }
  return unobfuscate(json);
}

export function rpcGet(args: any) {
  return rpcStrategy(7, args); // Network only
}

export async function rpcStrategy(...data: any[]) {
  // const data = Array.from(arguments);
  const strat = data.shift();

  const queryString = toQuery(data);

  const res = await fetch("/api/rpc" + queryString, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "SW-Cache-Strategy": strat,
    },
  });

  const json = await res.json();
  if (json != null && json.error) {
    json.method = queryString;
    throw new Error(JSON.stringify(json));
  }
  return unobfuscate(json);
}
