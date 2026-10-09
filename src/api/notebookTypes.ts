export type NotebookItem = {
  id: string;
  title: string;
  text: string;
  revision: string;
  linkedJobIds?: string[];
  attachments: { id: string; name: string; size: number }[];
};
