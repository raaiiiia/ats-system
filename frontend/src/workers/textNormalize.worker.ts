self.onmessage = (event: MessageEvent<string>) => {
  const normalized = event.data
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+|www\.\S+/g, " ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ")
    .replace(/(?:\+?\d[\s-]?){7,15}/g, " ")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  self.postMessage(normalized);
};

