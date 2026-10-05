import type { CategoryDerivations } from "../../scripts/lib/derived-config.js";

/**
 * Food & beverage (`icons/<style>-<variant>/food-beverage/`): how this category's drawings are derived from
 * its Lucide outlines. See docs/filled.md and docs/sharp.md, and config/derived/README.md.
 */
export const derivations: CategoryDerivations = {
  // Icons with a filled drawing; `roles` overrides the inferred role by outline element index.
  filled: {
    // The stem stays a line; filled, its hook closes into a wedge.
    apple: { roles: { 0: "stroke" } },
    bean: {},
    beef: {},
    // The foam sits in front of the mug, with a gap along its wavy edge.
    beer: { roles: { 3: "front" } },
    "bottle-wine": {},
    // The cherry sits in front of the slice, with a gap around it, rather than merging into a bump.
    "cake-slice": { roles: { 3: "front" } },
    // The open lid sits in front of the can, with a gap around it.
    can: { roles: { 1: "front" } },
    // Override (round and sharp filled): the second notch, the tail of the body's path, is cut like the first.
    carrot: {},
    // Override (round and sharp filled): the fold, the cap's seam and the front seam, all in the body's path, are cut.
    // Also a sharp-outline override: the same path drawn in another order, so the fold's turn into the roof edge
    // (a 47° miter) no longer spikes out past the cap's side.
    carton: {},
    "chef-hat": {},
    cherry: {},
    // Override (round and sharp filled): the handle, the tail of the cup's path, stays a line like beer's.
    coffee: {},
    // The lid's knob stays a line attached to the lid, like trash's handle; the lid stays a line.
    "cooking-pot": { roles: { 2: "stroke", 3: "stroke" } },
    // The straw stays a line attached to the lid; filled, it closes into a wedge.
    "cup-soda": { roles: { 3: "stroke" } },
    donut: {},
    // The bone is solid like the meat; inference leaves it a hollow handle.
    drumstick: { roles: { 1: "fill" } },
    egg: {},
    "egg-fried": {},
    // Override (round and sharp filled): a solid lens body; the tail stays two crossing lines, not a filled wedge.
    "fish-symbol": {},
    "glass-water": {},
    // The cut face sits in front of the joint, with a gap around it; the bone is solid, like drumstick's.
    ham: { roles: { 1: "front", 2: "fill" } },
    // Override (round and sharp filled): the patty is a closed pill in front of the buns; the cheese is left out.
    hamburger: {},
    // Override (round and sharp filled): solid scoops, and the rim, part of the bowl's path, cut, so the scoops
    // sit apart from the bowl; merged into one silhouette it reads as a tree.
    "ice-cream-bowl": {},
    // Override (round and sharp filled): a solid scoop, and the band's lower edge, part of the scoop's path, cut,
    // so the scoop sits apart from the cone, as in ice-cream-bowl.
    "ice-cream-cone": {},
    // The stem hangs from the glass rather than crossing it.
    martini: { roles: { 1: "stroke" } },
    // The feet hang from the body rather than crossing it.
    microwave: { roles: { 3: "stroke", 4: "stroke" } },
    milk: {},
    // Override (round and sharp filled): the flap's lower edge and the front fold, in the flap's path, are cut.
    "paper-bag": {},
    // The stick stays attached to the ice rather than crossing it.
    popsicle: { roles: { 1: "stroke" } },
    refrigerator: {},
    // The foot and spoon stay attached to the bowl; the steam stays lines (filled, each closes into a blob).
    soup: { roles: { 1: "stroke", 2: "stroke", 3: "stroke", 4: "stroke", 5: "stroke" } },
  },
  // Outline elements the sharp style keeps round, by element index, each with its reason.
  keepRound: {
    apple: [0, 1], // Fruit: the body's lobes and the stem's curl.
    beef: [0, 1], // The cut of meat's organic outline and its fat rim.
    "beef-off": [2, 5], // As beef: the fat rim and the meat's outline.
    broccoli: [1], // The stalk's rounded end.
    citrus: [0], // The rind's rounded tips; squared, the lower tip kinks.
    croissant: [0, 1, 2, 3, 4], // Pastry: every segment's rounded ends; squared, they turn into shards.
    cupcake: [1, 4], // The frosting's rounded shoulders.
    fish: [4, 5], // The fins.
    "fish-off": [2], // As fish: the fins (the slash shares the element).
    hamburger: [1], // The top bun, whose rounded ends meet the patty's.
    hop: [0, 1, 2, 3, 4, 5, 7], // The cone's scale tips.
    "hop-off": [0, 1, 2, 3, 4, 5, 6, 7], // As hop: the cone's scale tips.
    nut: [0, 1], // The nut's tip and the husk's tips, as hop's.
    "nut-off": [0, 3, 4], // As nut.
    popsicle: [0], // The ice's rounded end; Lucide's corner roundings differ, so squared, one corner kinks.
    soup: [3, 4, 5], // The steam wisps; squared, they turn into zigzags.
    // The candle flames: figurative dots, round in sharp (UI dots stay square).
    cake: [6, 7, 8],
  },
  // Roles for the sharp filled drawing that differ from the round one, by element index.
  sharpFilledRoles: {},
};
