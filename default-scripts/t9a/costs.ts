export function cost(val: number | undefined) {
  if (!val) return undefined;
  return [
    {
      name: "pts",
      typeId: "24fd-8af8-0c78-001c",
      value: val,
    },
  ];
}

export function specialCostType() {
  return "78d6-b449-3c80-9b2a";
}

export function specialCost(val: number) {
  return {
    name: "Special Equipment",
    typeId: "78d6-b449-3c80-9b2a",
    value: val,
  };
}
