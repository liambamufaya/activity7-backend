const router = require("express").Router();
const { all, get, run } = require("../db");

const ALLOWED_STATUSES = new Set(["Pending", "In progress", "Completed"]);

function parsePositiveId(rawId) {
  if (typeof rawId !== "string" || !/^[1-9]\d*$/.test(rawId)) {
    return null;
  }
  const num = Number(rawId);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

function validateRecordPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const { title, category, description, status } = body;

  if (typeof title !== "string") {
    return { error: "Title must be a string." };
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length < 3 || trimmedTitle.length > 80) {
    return { error: "Title must have 3 to 80 characters." };
  }

  if (typeof category !== "string") {
    return { error: "Category must be a string." };
  }
  const trimmedCategory = category.trim();
  if (trimmedCategory.length < 2 || trimmedCategory.length > 40) {
    return { error: "Category must have 2 to 40 characters." };
  }

  if (typeof description !== "string") {
    return { error: "Description must be a string." };
  }
  const trimmedDescription = description.trim();
  if (trimmedDescription.length < 5 || trimmedDescription.length > 300) {
    return { error: "Description must have 5 to 300 characters." };
  }

  if (typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
    return {
      error: "Status must be one of: Pending, In progress, Completed.",
    };
  }

  return {
    data: {
      title: trimmedTitle,
      category: trimmedCategory,
      description: trimmedDescription,
      status,
    },
  };
}

// GET /api/records
router.get("/", async (req, res, next) => {
  try {
    const rows = await all(
      "SELECT id, title, category, description, status FROM records ORDER BY id ASC"
    );
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/records/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "ID must be a positive whole number." });
    }

    const row = await get(
      "SELECT id, title, category, description, status FROM records WHERE id = ?",
      [id]
    );
    if (!row) {
      return res.status(404).json({ message: "Record not found." });
    }

    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
});

// POST /api/records
router.post("/", async (req, res, next) => {
  try {
    const { data, error } = validateRecordPayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const result = await run(
      "INSERT INTO records (title, category, description, status) VALUES (?, ?, ?, ?)",
      [data.title, data.category, data.description, data.status]
    );

    const created = await get(
      "SELECT id, title, category, description, status FROM records WHERE id = ?",
      [result.lastID]
    );

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/records/:id
router.put("/:id", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "ID must be a positive whole number." });
    }

    const { data, error } = validateRecordPayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const existing = await get("SELECT id FROM records WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ message: "Record not found." });
    }

    await run(
      "UPDATE records SET title = ?, category = ?, description = ?, status = ? WHERE id = ?",
      [data.title, data.category, data.description, data.status, id]
    );

    const updated = await get(
      "SELECT id, title, category, description, status FROM records WHERE id = ?",
      [id]
    );

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/records/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "ID must be a positive whole number." });
    }

    const result = await run("DELETE FROM records WHERE id = ?", [id]);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Record not found." });
    }

    res.status(200).json({ message: "Record deleted." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;