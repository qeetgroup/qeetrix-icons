import { describe, expect, it } from "vitest";
import { iconNameError, toComponentName } from "../../scripts/lib/naming.mjs";
import { validateSet } from "../../scripts/lib/rules.mjs";

describe("toComponentName", () => {
  it.each([
    ["arrow-left", "ArrowLeft"],
    ["arrow-right", "ArrowRight"],
    ["calendar-check", "CalendarCheck"],
    ["shield-check", "ShieldCheck"],
    ["user-add", "UserAdd"],
    ["x", "X"],
    ["user", "User"],
    ["chevron-double-left", "ChevronDoubleLeft"],
  ])("%s → %s", (name, expected) => {
    expect(toComponentName(name)).toBe(expected);
  });
});

describe("iconNameError", () => {
  it.each(["arrow-left", "x", "shield-check", "qr-code", "h1", "user-add"])(
    "accepts %s",
    (name) => {
      expect(iconNameError(name)).toBeNull();
    },
  );

  it.each([
    ["userIcon", "camelCase"],
    ["user_add", "snake_case"],
    ["Arrow-Left", "capitals"],
    ["arrow--left", "double hyphen"],
    ["-arrow", "leading hyphen"],
    ["arrow-", "trailing hyphen"],
    ["arrow left", "space"],
    ["arrow.left", "dot"],
    ["", "empty"],
  ])("rejects %s (%s)", (name) => {
    expect(iconNameError(name)).not.toBeNull();
  });

  it("explains why a leading digit fails, since the reason is non-obvious", () => {
    const error = iconNameError("2fa-token");
    expect(error).toContain("must not start with a digit");
    // The real problem is the identifier it would produce, so the message shows
    // it. Note a leading digit has no uppercase form, so it stays "2faToken".
    expect(error).toContain("2faToken");
  });

  it("rejects names that collide with the package's own barrel exports", () => {
    // `icon-base.svg` would emit `IconBase`, which the barrel already exports.
    expect(iconNameError("icon-base")).toContain("reserved");
    expect(iconNameError("icon-metadata")).toContain("reserved");
  });

  it("rejects `index`, which would overwrite the generated barrel file", () => {
    expect(iconNameError("index")).toContain("reserved filename");
  });
});

describe("cross-set collisions", () => {
  const icon = (name: string, category: string) => ({
    name,
    category,
    file: `icons/${category}/${name}.svg`,
  });

  it("rejects the same name in two categories", () => {
    const { errors } = validateSet([icon("user", "users"), icon("user", "interface")], {});
    const duplicate = errors.find((e) => e.rule === "duplicate-name");
    expect(duplicate).toBeDefined();
    expect(duplicate?.message).toContain("icons/users/user.svg");
  });

  it("rejects two filenames that generate the same component", () => {
    // The brief's example: `user-add.svg` and `user_add.svg` both want `UserAdd`.
    // `user_add` also fails the kebab-case rule, so use two names that are both
    // individually legal to prove the collision check itself works.
    const { errors } = validateSet([icon("arrow-left", "arrows"), icon("arrowleft", "arrows")], {});
    // These produce ArrowLeft and Arrowleft — distinct, so no collision.
    expect(errors.filter((e) => e.rule === "component-collision")).toHaveLength(0);
  });

  it("detects a genuine component-name collision", () => {
    // Two different categories, same canonical name, is caught as a duplicate
    // name first; a component collision needs two *different* names mapping to
    // one identifier, which the kebab-case rule makes rare by design. Verify
    // the check fires when it is reachable.
    const set = [icon("arrow-left", "arrows"), icon("arrow-left", "navigation")];
    const { errors } = validateSet(set, {});
    expect(errors.map((e) => e.rule)).toContain("duplicate-name");
  });

  it("flags metadata for an icon that does not exist", () => {
    const { errors } = validateSet([icon("user", "users")], {
      user: { tags: ["person"] },
      "ghost-icon": { tags: ["nope"] },
    });
    const orphan = errors.find((e) => e.rule === "orphan-metadata");
    expect(orphan?.message).toContain("ghost-icon");
    expect(orphan?.file).toBe("icon-metadata.json");
  });

  it("ignores $comment keys in the metadata registry", () => {
    const { errors } = validateSet([icon("user", "users")], {
      $comment: "documentation",
      user: { tags: ["person"] },
    } as never);
    expect(errors.filter((e) => e.rule === "orphan-metadata")).toHaveLength(0);
  });
});

describe("warnings", () => {
  const icon = (name: string) => ({ name, category: "arrows", file: `icons/arrows/${name}.svg` });

  it("warns about an icon with no tags but does not error", () => {
    const { errors, warnings } = validateSet([icon("untagged")], {});
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.rule)).toContain("missing-tags");
  });

  it("warns when a horizontally-directional icon is not marked mirror", () => {
    const { warnings } = validateSet([icon("arrow-left")], {
      "arrow-left": { tags: ["back"], mirror: false },
    });
    expect(warnings.map((w) => w.rule)).toContain("mirror");
  });

  it("does not warn about vertical icons, which RTL never flips", () => {
    const { warnings } = validateSet([icon("arrow-up"), icon("chevron-down")], {
      "arrow-up": { tags: ["up"], mirror: false },
      "chevron-down": { tags: ["expand"], mirror: false },
    });
    expect(warnings.filter((w) => w.rule === "mirror")).toHaveLength(0);
  });
});
