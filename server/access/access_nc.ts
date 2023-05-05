import { RPCRequest } from "../api/rpc";
import { H3Event } from "h3";

export interface NRServerSession {
  user: {
    permission: number;
  };
}

export default class CAccessNc {
  request: RPCRequest;
  event: H3Event;
  session: NRServerSession;

  constructor(event: H3Event, req: RPCRequest) {
    this.event = event;
    this.request = req;
    this.session = event.context.session;
  }

  async test() {
    return "Ca marche";
  }

  async login(userName: string, encryptedPassword: string) {
    this.session.user = { permission: 10 };
  }
}
