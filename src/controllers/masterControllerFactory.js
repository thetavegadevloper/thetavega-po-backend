const ApiError = require("../utils/ApiError");

function buildSearch(search, fields) {
  if (!search || !fields?.length) return {};
  const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return { $or: fields.map((field) => ({ [field]: regex })) };
}

function factory(Model, { searchFields = [], sort = { createdAt: -1 } } = {}) {
  return {
    list: async (req, res) => {
      const page = Math.max(Number(req.query.page || 1), 1);
      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
      const filter = {
        ...buildSearch(req.query.search, searchFields)
      };
      if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
      if (req.query.scope) filter.scope = req.query.scope;
      if (req.query.category) filter.category = req.query.category;

      const [data, total] = await Promise.all([
        Model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
        Model.countDocuments(filter)
      ]);
      res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    },

    getById: async (req, res) => {
      const data = await Model.findById(req.params.id).lean();
      if (!data) throw new ApiError(404, "Record not found");
      res.json({ success: true, data });
    },

    create: async (req, res) => {
      const data = await Model.create(req.body);
      res.status(201).json({ success: true, data });
    },

    update: async (req, res) => {
      const data = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      });
      if (!data) throw new ApiError(404, "Record not found");
      res.json({ success: true, data });
    },

    setStatus: async (req, res) => {
      if (typeof req.body?.isActive !== "boolean") throw new ApiError(400, "isActive boolean is required");
      const data = await Model.findByIdAndUpdate(
        req.params.id,
        { isActive: req.body.isActive },
        { new: true, runValidators: true }
      );
      if (!data) throw new ApiError(404, "Record not found");
      res.json({ success: true, data });
    }
  };
}

module.exports = factory;
