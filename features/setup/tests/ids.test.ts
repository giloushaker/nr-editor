import { describe, expect, it } from "vitest";
import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { idFor, shortSlug } from "../rename";

const withIds = (...ids: string[]) => ({ findOptionByIdGlobal: (id: string) => (ids.includes(id) ? {} : undefined) }) as unknown as Catalogue;

describe("ids", () => {
  it("the name alone when free, four words at most", () => {
    expect(idFor(withIds(), "Boltgun")).toBe("boltgun");
    expect(shortSlug("One Legionnaire may replace his boltgun with one of the following:")).toBe("one-legionnaire-may-replace");
    expect(idFor(withIds(), "replace Boltgun", "legion-of-the-damned-squad-model")).toBe("replace-boltgun");
  });
  it("taken: the parent's last two words in front, then a number", () => {
    expect(idFor(withIds("boltgun"), "Boltgun", "legion-of-the-damned-squad-model")).toBe("squad-model-boltgun");
    expect(idFor(withIds("boltgun", "squad-model-boltgun"), "Boltgun", "legion-of-the-damned-squad-model")).toBe("squad-model-boltgun-2");
    expect(idFor(withIds("boltgun"), "Boltgun")).toBe("boltgun-2");
  });
  it("unnamed gets the fallback", () => {
    expect(idFor(withIds(), "", undefined, "model")).toBe("model");
  });
});
