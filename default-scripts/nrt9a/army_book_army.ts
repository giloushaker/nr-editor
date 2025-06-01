import { ArmyBookArmy, ArmyBookBook } from "./army_book_interfaces";
import { convertArmyBookUnit } from "./army_book_unit";

export function getArmyUnits(opt: ArmyBookBook): Record<string, any>[] {
  const res: Record<string, any>[] = [];
  for (let cat of opt.army[0].options) {
    for (let unit of cat.options) {
      const converted = convertArmyBookUnit(unit);
      res.push(converted);
    }
  }

  return res;
}
