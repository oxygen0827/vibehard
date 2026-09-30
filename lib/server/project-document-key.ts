import { z } from "zod";
// Object locations are built only from checked server identities, never user filenames.
export function projectOriginalKey(userId: string, projectId: string, id: string, sha: string) {
  for (const value of [userId, projectId, id]) z.uuid().parse(value);
  z.string().regex(/^[a-f0-9]{64}$/).parse(sha);
  return `projects/raw/v1/${userId}/${projectId}/${id}/${sha}`;
}
