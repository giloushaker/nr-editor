export interface OptionTree {
  options?: Array<OptionTree>;
}

export function deepTrasverse<T extends OptionTree>(
  opt: T,
  callback: (opt: T) => void,
  condition: ((opt: T) => boolean) | null = null
): void {
  let conditionMet = true;

  if (condition != null) {
    conditionMet = condition(opt);
  }

  if (conditionMet == true) {
    callback(opt);

    if (opt.options != null) {
      for (const child of opt.options) {
        deepTrasverse(child as T, callback, condition);
      }
    }
  }
}

export function findOption(root: any, id: string): any {
  let res: any = null;
  deepTrasverse(root, (child: any) => {
    if (res == null && child.option_id == id) {
      res = child;
    }
  });
  return res;
}
