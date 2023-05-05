import {
  BookFetchFunction,
  BsGameSystem,
} from "~/assets/shared/systems/bs_game_system";
import { GameSystemRow } from "~/assets/shared/types/db_types";

export class GameSystem extends BsGameSystem {
  constructor(
    systemRow: GameSystemRow,
    lang: string,
    fetchStrategy: BookFetchFunction
  ) {
    super(systemRow, lang, fetchStrategy);
  }
}
