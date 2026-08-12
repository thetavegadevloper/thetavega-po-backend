const mongoose = require("mongoose");

// =====================================================
// MASTER SEQUENCE
//
// Stores the latest running number for each master.
//
// Example:
//
// vendors   -> 12
// companies -> 5
// materials -> 28
// =====================================================
const MasterSequenceSchema =
  new mongoose.Schema(
    {
      key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
      },

      value: {
        type: Number,
        required: true,
        default: 0,
        min: 0
      }
    },
    {
      timestamps: true
    }
  );

module.exports =
  mongoose.model(
    "MasterSequence",
    MasterSequenceSchema
  );