interface Category {
  targetId: string;
  name: string;
  primary: boolean;
}

const categories: Record<string, Category> = {
  core: {
    targetId: "4bcd-01c8-ce5e-7108",
    name: "Core",
    primary: false,
  },

  character: {
    name: "Characters",
    primary: false,
    targetId: "953d-22cd-7ee1-36dc",
  },

  rare: {
    name: "Rare",
    primary: false,
    targetId: "49b2-6bb3-e381-a34e",
  },

  special: {
    name: "Special",
    primary: false,
    targetId: "f8f1-3d4f-12bf-73cd",
  },
};

export default categories;
