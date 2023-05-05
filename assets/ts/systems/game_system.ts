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

  // public static loadFromGst(gstData: File): GameSystem {}
  // public addCatalogue(catData: File): void;
  // public toJson(): JsonGameSystem;
  // public static fromJson(system: JsonGameSystem): GameSystem;
  // public exportGst
  // public exportCat
}
