import { GithubDatabaseEntry, encode } from "./deps.ts";
import { consoleTable } from "./console_table.ts";
import { generateTsvFile } from "./tsv_file_creator.ts";
import { generateMarkdownFile } from "./markdown_file_creator.ts";

if (Deno.args.length < 2) {
  console.log(Deno.args);
  console.info(
    "Please input your github account. Limit 5000 req per hour by GitHub.",
  );
  console.info(
    "ex: deno run --allow-net --allow-write <username> <password> <file|table (default is file)>",
  );
  Deno.exit(1);
}

const username = Deno.args[0];
const password = Deno.args[1];
const File = "file";
const Table = "table";
const MarkdownFile = "markdown";
type Format = typeof File | typeof Table | typeof MarkdownFile;
const format: Format | undefined = Deno.args[2] as Format;

const databaseUrl =
  "https://raw.githubusercontent.com/denoland/deno_website2/master/database.json";
const res = await fetch(databaseUrl);

const entries: Readonly<Record<string, GithubDatabaseEntry>> = await res.json();

// 表示させたいリポジトリ情報
export type Repository = {
  name: string;
  full_name: string; // owner name +  repository name
  html_url: string;
  stargazers_count: number;
  forks: number;
  watchers: number;
  subscribers_count: number;
  archived: boolean;
  description: string;
};

type RepositoryKey = keyof Repository;

const repositoryPromises: Promise<Repository>[] = [];

for (const key of Object.keys(entries)) {
  //console.dir(entries[key]);

  const fetchUrl = `https://api.github.com/repos/${entries[key].owner}/${
    entries[key].repo
  }`;

  repositoryPromises.push(
    fetch(fetchUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${encode(username + ":" + password)}`,
      },
    }).then((r) => r.json()),
  );

  // For Manual Testing
  // if (repositoryPromises.length > 3) {
  //   break;
  // }
}

const repositories: Repository[] = await Promise.all(repositoryPromises);

const result: Repository[] = [];
for (const repository of repositories) {
  if (repository !== undefined && repository.name !== undefined) {
    result.push(repository);
  }
}

export const sortedResult = result.sort(
  (a, b) => {
    if (a.stargazers_count < b.stargazers_count) return 1;
    else if (
      a.forks < b.forks && a.stargazers_count == b.stargazers_count
    ) {
      return 1;
    } else if (
      a.watchers < b.watchers && a.forks == b.forks &&
      a.stargazers_count == b.stargazers_count
    ) {
      return 1;
    } else if (
      a.subscribers_count < b.subscribers_count && a.watchers == b.watchers &&
      a.forks == b.forks && a.stargazers_count == b.stargazers_count
    ) {
      return 1;
    }
    return -1;
  },
);

switch (format) {
  case Table:
    consoleTable(sortedResult);
    break;
  case File:
    await generateTsvFile(sortedResult);
    break;
  case MarkdownFile:
    await generateMarkdownFile(sortedResult);
    break;
}
