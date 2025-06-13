// src/models/modpack.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IVersion {
  name?: string;
  id?: string;
  zip?: string;
  size?: string;
  changelog?: string;
  date?: string;
  visible?: boolean;
  clean?: boolean;
}

export interface IModpack extends Document {
  id: string;
  index?: number;
  name?: string;
  thumbnail?: string;
  background?: string;
  mainVersion?: IVersion;
  status?: string;
  jvmArgs?: string;
  versions: IVersion[];
}

const versionSchema = new Schema<IVersion>({
  name: { type: String },
  id: { type: String },
  zip: { type: String },
  size: { type: String },
  changelog: { type: String },
  date: { type: String },
  visible: { type: Boolean },
  clean: { type: Boolean },
});

const modpackSchema = new Schema<IModpack>({
  id: { type: String, required: true },
  index: { type: Number, default: 0 },
  name: { type: String },
  thumbnail: { type: String },
  background: { type: String },
  mainVersion: { type: versionSchema },
  status: { type: String },
  jvmArgs: { type: String },
  versions: { type: [versionSchema], default: [] },
});

const Modpack: Model<IModpack> = mongoose.model<IModpack>('Modpack', modpackSchema);

export default Modpack;
