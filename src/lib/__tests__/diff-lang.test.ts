import { describe, it, expect } from "vitest";
import { getDiffLanguage } from "@/lib/diff-lang";

describe("getDiffLanguage", () => {
  it('returns "json" for .json files', () => {
    expect(getDiffLanguage("config.json")).toBe("json");
  });

  it('returns "yaml" for .yaml files', () => {
    expect(getDiffLanguage("config.yaml")).toBe("yaml");
  });

  it('returns "yaml" for .yml files', () => {
    expect(getDiffLanguage("config.yml")).toBe("yaml");
  });

  it('returns "toml" for .toml files', () => {
    expect(getDiffLanguage("config.toml")).toBe("toml");
  });

  it('returns "xml" for .xml files', () => {
    expect(getDiffLanguage("config.xml")).toBe("xml");
  });

  it('returns "ini" for .conf files', () => {
    expect(getDiffLanguage("httpd.conf")).toBe("ini");
  });

  it('returns "ini" for .ini files', () => {
    expect(getDiffLanguage("settings.ini")).toBe("ini");
  });

  it('returns "ini" for .cfg files', () => {
    expect(getDiffLanguage("config.cfg")).toBe("ini");
  });

  it('returns "plaintext" for .env files', () => {
    expect(getDiffLanguage(".env")).toBe("plaintext");
  });

  it('returns "plaintext" for .txt files', () => {
    expect(getDiffLanguage("readme.txt")).toBe("plaintext");
  });

  it('returns "markdown" for .md files', () => {
    expect(getDiffLanguage("readme.md")).toBe("markdown");
  });

  it("returns undefined for unknown extensions", () => {
    expect(getDiffLanguage("file.js")).toBeUndefined();
    expect(getDiffLanguage("file.ts")).toBeUndefined();
    expect(getDiffLanguage("file.css")).toBeUndefined();
    expect(getDiffLanguage("file.html")).toBeUndefined();
    expect(getDiffLanguage("file.sh")).toBeUndefined();
  });

  it("returns undefined for files with no extension", () => {
    expect(getDiffLanguage("Makefile")).toBeUndefined();
    expect(getDiffLanguage("Dockerfile")).toBeUndefined();
    expect(getDiffLanguage("README")).toBeUndefined();
  });

  it("is case insensitive", () => {
    expect(getDiffLanguage("config.JSON")).toBe("json");
    expect(getDiffLanguage("config.YAML")).toBe("yaml");
    expect(getDiffLanguage("config.TOML")).toBe("toml");
    expect(getDiffLanguage("Config.Xml")).toBe("xml");
    expect(getDiffLanguage("Config.InI")).toBe("ini");
  });

  it("handles nested paths", () => {
    expect(getDiffLanguage("config/settings.json")).toBe("json");
    expect(getDiffLanguage("env/.env")).toBe("plaintext");
    expect(getDiffLanguage("nested/deep/file.yaml")).toBe("yaml");
  });
});
