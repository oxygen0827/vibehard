import { createHash } from "node:crypto";
import path from "node:path";
import { projectFilePath, projectFilesSchema, type ProjectFiles } from "@/lib/agent/project-document";
import { writeImmutableProjectFile } from "./design-files";

export async function materializeProjectFiles(workspace: string, input: ProjectFiles, projectId: string) {
  const payload = projectFilesSchema.parse(input);
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  if (payload.revision !== hash(JSON.stringify(payload.files.map(file => [file.documentId, file.sha256]))) ||
    new Set(payload.files.map(file => file.documentId)).size !== payload.files.length ||
    payload.files.some(file => file.projectId !== projectId || hash(file.markdown) !== file.sha256)) throw new Error("项目资料归属或内容校验失败，任务未执行");
  for (const file of payload.files) await writeImmutableProjectFile(workspace, "documents", path.basename(projectFilePath(file)), file.markdown, file.sha256);
  return payload.files.map(file => projectFilePath(file));
}
