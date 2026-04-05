/**
 * Hïve — Google Drive Service
 * Criação de estrutura de pastas e documentos para projetos
 */

import { getDecryptedToken } from "@/lib/integrations/token-vault";
import { createAdminClient } from "@/lib/supabase/admin";

interface DriveCredentials {
  access_token: string;
  refresh_token: string;
}

async function getDriveCredentials(orgId: string): Promise<DriveCredentials | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("integrations")
    .select("encrypted_token")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .eq("is_active", true)
    .single();

  if (!data?.encrypted_token) return null;
  const decrypted = await getDecryptedToken(data.encrypted_token);
  return JSON.parse(decrypted);
}

async function driveRequest(
  credentials: DriveCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${credentials.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Drive API error ${response.status}: ${err}`);
  }
  return response;
}

export interface ProjectFolderResult {
  rootFolderId: string;
  docsFolderId: string;
  entregaveisFolderId: string;
  contratosFolderId: string;
}

/**
 * Cria a estrutura de pastas padrão para um projeto:
 * /Projetos Hïve/{Nome do Projeto}/
 *   ├── Docs/
 *   ├── Entregáveis/
 *   └── Contratos/
 */
export async function createProjectFolder(
  orgId: string,
  projectName: string,
  projectSlug: string
): Promise<ProjectFolderResult | null> {
  const credentials = await getDriveCredentials(orgId);
  if (!credentials) {
    console.warn(`[DriveService] No Google credentials for org ${orgId}`);
    return null;
  }

  try {
    // 1. Find or create root "Projetos Hïve" folder
    let rootParentId = await findOrCreateRootFolder(credentials);

    // 2. Create project folder
    const projectFolder = await driveRequest(
      credentials,
      "/files",
      {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [rootParentId],
          description: `Pasta do projeto ${projectName} — gerenciada pelo Hïve`,
        }),
      }
    );
    const projectFolderData = await projectFolder.json();
    const rootFolderId = projectFolderData.id;

    // 3. Create subfolders in parallel
    const [docsFolder, entregaveisFolder, contratosFolder] = await Promise.all([
      createSubfolder(credentials, rootFolderId, "📄 Docs"),
      createSubfolder(credentials, rootFolderId, "📦 Entregáveis"),
      createSubfolder(credentials, rootFolderId, "📋 Contratos"),
    ]);

    console.info(`[DriveService] Created project folder structure for "${projectName}" (${rootFolderId})`);

    return {
      rootFolderId,
      docsFolderId: docsFolder,
      entregaveisFolderId: entregaveisFolder,
      contratosFolderId: contratosFolder,
    };
  } catch (error) {
    console.error(`[DriveService] Failed to create project folder:`, error);
    return null;
  }
}

async function findOrCreateRootFolder(credentials: DriveCredentials): Promise<string> {
  // Search for existing "Projetos Hïve" folder
  const searchRes = await driveRequest(
    credentials,
    `/files?q=name='Projetos Hïve' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
  );
  const { files } = await searchRes.json();

  if (files && files.length > 0) {
    return files[0].id;
  }

  // Create it
  const createRes = await driveRequest(credentials, "/files", {
    method: "POST",
    body: JSON.stringify({
      name: "Projetos Hïve",
      mimeType: "application/vnd.google-apps.folder",
      description: "Pasta raiz dos projetos gerenciados pelo Hïve",
    }),
  });
  const data = await createRes.json();
  return data.id;
}

async function createSubfolder(
  credentials: DriveCredentials,
  parentId: string,
  name: string
): Promise<string> {
  const res = await driveRequest(credentials, "/files", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const data = await res.json();
  return data.id;
}

/**
 * Cria documento de Escopo de Projeto usando template Google Docs
 */
export async function createScopeDocument(
  orgId: string,
  parentFolderId: string,
  projectName: string,
  clientName: string,
  scopeContent: string
): Promise<string | null> {
  const credentials = await getDriveCredentials(orgId);
  if (!credentials) return null;

  try {
    // Create Google Doc in the Docs subfolder
    const res = await driveRequest(credentials, "/files", {
      method: "POST",
      body: JSON.stringify({
        name: `Escopo — ${projectName}`,
        mimeType: "application/vnd.google-apps.document",
        parents: [parentFolderId],
        description: `Documento de escopo do projeto ${projectName} para ${clientName}`,
      }),
    });
    const { id: docId } = await res.json();

    // Populate with content using Docs API
    await populateDocument(credentials, docId, projectName, clientName, scopeContent);

    console.info(`[DriveService] Created scope document ${docId} for "${projectName}"`);
    return docId;
  } catch (error) {
    console.error(`[DriveService] Failed to create scope document:`, error);
    return null;
  }
}

async function populateDocument(
  credentials: DriveCredentials,
  docId: string,
  projectName: string,
  clientName: string,
  content: string
): Promise<void> {
  const today = new Date().toLocaleDateString("pt-BR");

  await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `Escopo do Projeto — ${projectName}\n\nCliente: ${clientName}\nData: ${today}\n\n${content}`,
            },
          },
          {
            updateParagraphStyle: {
              range: { startIndex: 1, endIndex: `Escopo do Projeto — ${projectName}`.length + 1 },
              paragraphStyle: { namedStyleType: "HEADING_1" },
              fields: "namedStyleType",
            },
          },
        ],
      }),
    }
  );
}
