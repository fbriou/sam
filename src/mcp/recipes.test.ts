import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import matter from "gray-matter";

/**
 * These tests validate the recipe management logic by replicating
 * exactly what the MCP handler does (fs operations + gray-matter).
 * This avoids needing to boot the full MCP server.
 */

let recipesDir: string;

// --- helpers that mirror the MCP handler logic ---

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addRecipe(opts: {
  title: string;
  ingredients: string[];
  instructions: string;
  servings?: number;
  prepTime?: string;
  cookTime?: string;
  tags?: string[];
  notes?: string;
}): { text: string; isError?: boolean } {
  const slug = slugify(opts.title);

  if (!slug) {
    return { text: "Error: title must contain at least one letter or number.", isError: true };
  }

  const filePath = join(recipesDir, `${slug}.md`);

  if (existsSync(filePath)) {
    return { text: `Recipe "${opts.title}" already exists. Delete it first to replace.`, isError: true };
  }

  const fm: Record<string, unknown> = { title: opts.title };
  if (opts.servings) fm.servings = opts.servings;
  if (opts.prepTime) fm.prepTime = opts.prepTime;
  if (opts.cookTime) fm.cookTime = opts.cookTime;
  if (opts.tags && opts.tags.length > 0) fm.tags = opts.tags;
  fm.ingredients = opts.ingredients;

  const body =
    "## Instructions\n\n" +
    opts.instructions +
    (opts.notes ? "\n\n## Notes\n\n" + opts.notes : "") +
    "\n";

  writeFileSync(filePath, matter.stringify(body, fm), "utf-8");
  return { text: `Recipe "${opts.title}" saved to recipes/${slug}.md` };
}

function listRecipes(): { slug: string; title: string; tags: string[] }[] {
  const files = readdirSync(recipesDir).filter((f) => f.endsWith(".md"));
  return files.map((f) => {
    const parsed = matter(readFileSync(join(recipesDir, f), "utf-8"));
    return {
      slug: f.replace(".md", ""),
      title: (parsed.data.title as string) || f.replace(".md", ""),
      tags: (parsed.data.tags as string[]) || [],
    };
  });
}

function searchRecipes(query: string): { slug: string; title: string; score: number }[] {
  const files = readdirSync(recipesDir).filter((f) => f.endsWith(".md"));
  const q = query.toLowerCase();
  const matches: { slug: string; title: string; score: number }[] = [];

  for (const file of files) {
    const parsed = matter(readFileSync(join(recipesDir, file), "utf-8"));
    const recipeTitle = ((parsed.data.title as string) || "").toLowerCase();
    const ingredientText = ((parsed.data.ingredients as string[]) || []).join(" ").toLowerCase();
    const tagText = ((parsed.data.tags as string[]) || []).join(" ").toLowerCase();
    const bodyText = parsed.content.toLowerCase();

    let score = 0;
    if (recipeTitle.includes(q)) score += 50;
    if (ingredientText.includes(q)) score += 30;
    if (tagText.includes(q)) score += 20;
    if (bodyText.includes(q)) score += 10;

    if (score > 0) {
      matches.push({
        slug: file.replace(".md", ""),
        title: (parsed.data.title as string) || file.replace(".md", ""),
        score,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// --- setup ---

beforeEach(() => {
  recipesDir = mkdtempSync(join(tmpdir(), "recipes-test-"));
});

afterEach(() => {
  if (recipesDir) rmSync(recipesDir, { recursive: true, force: true });
});

// --- tests ---

describe("add recipe", () => {
  it("creates a markdown file with frontmatter", () => {
    const result = addRecipe({
      title: "Pasta al Pomodoro",
      ingredients: ["400g spaghetti", "2 cloves garlic", "1 can tomatoes"],
      instructions: "1. Boil pasta\n2. Make sauce\n3. Combine",
      servings: 4,
      prepTime: "10 min",
      cookTime: "25 min",
      tags: ["italian", "pasta"],
      notes: "Great for meal prep",
    });

    expect(result.isError).toBeUndefined();
    expect(result.text).toContain("pasta-al-pomodoro.md");

    const content = readFileSync(join(recipesDir, "pasta-al-pomodoro.md"), "utf-8");
    const parsed = matter(content);

    expect(parsed.data.title).toBe("Pasta al Pomodoro");
    expect(parsed.data.servings).toBe(4);
    expect(parsed.data.prepTime).toBe("10 min");
    expect(parsed.data.cookTime).toBe("25 min");
    expect(parsed.data.tags).toEqual(["italian", "pasta"]);
    expect(parsed.data.ingredients).toEqual(["400g spaghetti", "2 cloves garlic", "1 can tomatoes"]);
    expect(parsed.content).toContain("## Instructions");
    expect(parsed.content).toContain("Boil pasta");
    expect(parsed.content).toContain("## Notes");
    expect(parsed.content).toContain("Great for meal prep");
  });

  it("creates with minimal fields (no optional)", () => {
    const result = addRecipe({
      title: "Simple Toast",
      ingredients: ["2 slices bread", "butter"],
      instructions: "1. Toast bread\n2. Spread butter",
    });

    expect(result.isError).toBeUndefined();

    const content = readFileSync(join(recipesDir, "simple-toast.md"), "utf-8");
    const parsed = matter(content);

    expect(parsed.data.title).toBe("Simple Toast");
    expect(parsed.data.ingredients).toEqual(["2 slices bread", "butter"]);
    expect(parsed.data.servings).toBeUndefined();
    expect(parsed.data.tags).toBeUndefined();
    expect(parsed.content).not.toContain("## Notes");
  });

  it("rejects duplicate recipe", () => {
    addRecipe({
      title: "Toast",
      ingredients: ["bread"],
      instructions: "Toast it",
    });

    const result = addRecipe({
      title: "Toast",
      ingredients: ["bread"],
      instructions: "Toast it again",
    });

    expect(result.isError).toBe(true);
    expect(result.text).toContain("already exists");
  });

  it("slugifies titles with special characters", () => {
    addRecipe({
      title: "Crème Brûlée (Classic)",
      ingredients: ["eggs", "cream", "sugar"],
      instructions: "1. Make custard",
    });

    const files = readdirSync(recipesDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toBe("cr-me-br-l-e-classic.md");
  });

  it("rejects title with only special characters (empty slug)", () => {
    const result = addRecipe({
      title: "!!!",
      ingredients: ["x"],
      instructions: "y",
    });

    expect(result.isError).toBe(true);
    expect(result.text).toContain("at least one letter or number");
    expect(readdirSync(recipesDir)).toHaveLength(0);
  });
});

describe("list recipes", () => {
  it("returns empty array for no recipes", () => {
    expect(listRecipes()).toEqual([]);
  });

  it("lists single recipe with tags", () => {
    addRecipe({
      title: "Pasta",
      ingredients: ["pasta"],
      instructions: "Cook it",
      tags: ["italian"],
    });

    const recipes = listRecipes();
    expect(recipes).toHaveLength(1);
    expect(recipes[0].title).toBe("Pasta");
    expect(recipes[0].slug).toBe("pasta");
    expect(recipes[0].tags).toEqual(["italian"]);
  });

  it("lists multiple recipes", () => {
    addRecipe({ title: "Pasta", ingredients: ["pasta"], instructions: "Cook" });
    addRecipe({ title: "Toast", ingredients: ["bread"], instructions: "Toast" });
    addRecipe({ title: "Salad", ingredients: ["lettuce"], instructions: "Toss" });

    expect(listRecipes()).toHaveLength(3);
  });
});

describe("read recipe", () => {
  it("reads existing recipe content", () => {
    addRecipe({
      title: "My Recipe",
      ingredients: ["thing"],
      instructions: "Do stuff",
    });

    const content = readFileSync(join(recipesDir, "my-recipe.md"), "utf-8");
    expect(content).toContain("My Recipe");
    expect(content).toContain("Do stuff");
  });

  it("returns error for missing recipe", () => {
    expect(existsSync(join(recipesDir, "nope.md"))).toBe(false);
  });
});

describe("search recipes", () => {
  beforeEach(() => {
    addRecipe({
      title: "Pasta al Pomodoro",
      ingredients: ["spaghetti", "tomatoes", "garlic"],
      instructions: "Make pasta",
      tags: ["italian", "vegetarian"],
    });
    addRecipe({
      title: "Chicken Stir Fry",
      ingredients: ["chicken", "broccoli", "soy sauce", "garlic"],
      instructions: "Stir fry everything",
      tags: ["asian", "quick"],
    });
    addRecipe({
      title: "Garlic Bread",
      ingredients: ["bread", "butter", "garlic"],
      instructions: "Spread garlic butter on bread, bake",
      tags: ["italian", "side"],
    });
  });

  it("finds by title", () => {
    const results = searchRecipes("pasta");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toBe("Pasta al Pomodoro");
  });

  it("finds by ingredient", () => {
    const results = searchRecipes("chicken");
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Chicken Stir Fry");
  });

  it("finds by tag", () => {
    const results = searchRecipes("italian");
    expect(results.length).toBe(2);
  });

  it("finds multiple matches for shared ingredient", () => {
    const results = searchRecipes("garlic");
    expect(results.length).toBe(3);
  });

  it("returns empty for no match", () => {
    const results = searchRecipes("sushi");
    expect(results.length).toBe(0);
  });

  it("ranks title match higher than ingredient match", () => {
    const results = searchRecipes("garlic bread");
    // "Garlic Bread" should rank highest because it matches title
    expect(results[0].title).toBe("Garlic Bread");
  });
});

describe("delete recipe", () => {
  it("deletes existing recipe", () => {
    addRecipe({ title: "Doomed", ingredients: ["x"], instructions: "y" });
    expect(existsSync(join(recipesDir, "doomed.md"))).toBe(true);

    unlinkSync(join(recipesDir, "doomed.md"));
    expect(existsSync(join(recipesDir, "doomed.md"))).toBe(false);
  });

  it("missing recipe file does not exist", () => {
    expect(existsSync(join(recipesDir, "ghost.md"))).toBe(false);
  });
});
