import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { ArmyBookArmy, ArmyBookOption, ArmyBookUnit } from "./army_book_interfaces";
import { convertArmyBookOption } from "./army_book_option";

export function convertArmyBookUnit(catalogue: Catalogue, opt: ArmyBookUnit, army: ArmyBookArmy): Record<string, any> {
  const res = convertArmyBookOption(catalogue, opt, army, opt);
  res.type = "unit";
  return res;
}
