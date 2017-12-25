export interface Image {
  data: Buffer;
  height: number;
  width: number;
  deflateChunkSize?: number; // ?
  deflateLevel?: number; // ?
  deflateStrategy?: number; // ?
}
