import { createServer, IncomingMessage } from "http";
import { parse, DocumentNode, DefinitionNode, OperationDefinitionNode, SelectionSetNode, FieldNode } from "graphql";

async function getBody(request: IncomingMessage) {
  return new Promise<string>((ok, ng) => {
    let data = "";
    request.on("data", (chunk: string) => data += chunk);
    request.on("end", () => (ok(data), request.removeAllListeners()));
    request.on("error", ng);
  });
}

interface User {
  id: number;
  name: string;
  document: Document[];
  tweets: Tweet[];
}

interface Document {
  id: number;
  title: string;
  content: string;
  images: Image[];
}

interface Image {
  id: number;
  url: string;
}

interface Tweet {
  id: number;
  content: string;
}

const datas: any = {
  users: [
    { name: "yamada" },
    { name: "tomita" },
    { name: "ueda" },
  ].map((it, i) => ({ id: i, ...it })),
  documents: [
    { user: 0, title: "わたしの日記1", content: "ここに日記本文を書く。", images: [0, 1] },
    { user: 0, title: "5/3 晴", content: "晴れていた", images: [] },
    { user: 1, title: "クリスマスイブ♪", content: "イエスキリスト誕生日おめでとー！", images: [2] },
    { user: 1, title: "今日の晩ご飯", content: "ここに写真を貼る", images: [1] },
    { user: 2, title: "日記開設！", content: "よろしくお願いします。", images: [1, 2, 3] },
    { user: 2, title: "日記飽きました", content: "飽きましたので、やめます。", images: [] },
  ]
  .map(((it, i) => ({ id: i, ...it }))),
  images: [
    { url: "/image1.jpg" },
    { url: "/image2.jpg" },
    { url: "/image3.jpg" },
  ].map((it, i) => ({ id: i, ...it })),
  tweets: [
    { user: 0, content: "こんにちは" },
    { user: 1, content: "朝だね" },
    { user: 2, content: "おやすみー。" },
    { user: 0, content: "昨日はカツ丼を食べた" },
    { user: 1, content: "ラーメン食べたい" },
    { user: 2, content: "映画見る" },
    { user: 0, content: "お酒が好きです。" },
    { user: 1, content: "ヨーグルトを食べます。" },
    { user: 2, content: "仕事疲れたなう" },
  ].map((it, i) => ({ id: i, ...it })),
}

function isIndex(key: string | number | symbol) {
  return typeof key === "number" || (typeof key === "string" && !isNaN(parseInt(key, 10)));
}

const resolver = {
  get users(): User[] {
    return new Proxy(datas.users, {
      get(target, key) {
        if (isIndex(key)) {
          return {
            ...target[key],
            documents: resolver.documents.filter((it: any) => it.user === target[key].id),
            tweets: resolver.tweets.filter((it: any) => it.user === target[key].id)
          };
        }
        return target[key];
      }
    });
  },
  get documents(): Document[] {
    return new Proxy(datas.documents, {
      get(target, key) {
        if (isIndex(key)) {
          return {
            ...target[key],
            images: resolver.images.filter((it: any) => target[key].images.includes(it.id))
          }
        }
        return target[key];
      }
    });
  },
  get images(): Image[] {
    return datas.images;
  },
  get tweets(): Tweet[] {
    return datas.tweets;
  }
}

function gql(all: TemplateStringsArray, ...args: any[]) {
  return parse(all.join(""));
}

const TypeDef = gql`
  type User {
    id: ID!
    name: String!
  }

  type Document {
    id: ID!
    user: ID!
    title: String!
    content: String!
  }

  type Image {
    id: ID!
    url: String!
  }

  type Tweet {
    id: ID!
    user: ID!
    content: String!
  }

  type Query {
    users: [User]!
    documents: [Document]!
    images: [Image]!
    tweets: [Tweet]!
  }
`;

const Query = TypeDef.definitions.find(it => (it.kind === "ObjectTypeDefinition" && it.name.value === "Query"));

function field(field: FieldNode, data: any) {
  if (field.selectionSet) {
    return Array.isArray(data)
      ? data.map(it => query(field.selectionSet!, it))
      : query(field.selectionSet, data[field.name.value]);
  }
  return Array.isArray(data)
    ? data.map(it => it[field.name.value])
    : data[field.name.value];
}

function query(set: SelectionSetNode, data: any): any {
  if (Array.isArray(data)) {
    return data.map(it => query(set, it))
  } else {
    return set.selections.reduce<any>((prev, next) => {
      switch (next.kind) {
        case "Field":
          return { ...prev, [next.name.value]: field(next, data) };
      }
    }, {});
  }
}

function operate(def: OperationDefinitionNode) {
  switch (def.operation) {
    case "query":
      return query(def.selectionSet, resolver);
  }
}

const HEADERS = {
  CONTENT_TYPE_JSON: { "content-type": "application/json" },
  CONTENT_TYPE_TEXT: { "content-type": "text/plain" },
}

const server = createServer(async (request, response) => {
  try {
    const body = await getBody(request);
    const parsed = parse(body);
    const result = parsed.definitions.reduce((prev, next) => {
      switch (next.kind) {
        case "OperationDefinition":
          return { ...prev, ...operate(next) };
      }
      return {};
    }, {});
    response
      .writeHead(200, { ...HEADERS.CONTENT_TYPE_JSON, })
      .end(JSON.stringify({ data: result }));
  } catch (e) {
    console.error((e as Error).stack);
    response
      .writeHead(500, { ...HEADERS.CONTENT_TYPE_TEXT, })
      .end((e as Error).message);
  }
});

server.on("listening", () => console.log(`server started on: ${8001}`))
server.listen(8001);
