import { RPCRequest } from "../api/rpc";
import { H3Event } from "h3";
import CAccessNc, { NRServerSession } from "./access_nc";

export function getAccess(event: H3Event, req: RPCRequest): CAccessNc {
  let session: NRServerSession = event.context.session;

  if (!session?.user) {
    return new CAccessNc(event, req);
  }

  switch (session.user.permission) {
    case 1:
      return new CAccessNc(event, req);
    default:
      return new CAccessNc(event, req);
  }
}
