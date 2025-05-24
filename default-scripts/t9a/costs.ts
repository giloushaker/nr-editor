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
