// The reference model runs with TFJS CPU operations: no native TFLite addon.
// Its weights, preprocessing and character ordering come from StoreVia/Srmap-Api.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';
import manifest from '../data/captcha-model.json' with { type: 'json' };
let constantsPromise: Promise<Map<number, tf.Tensor>> | undefined;
async function constants() {
  return (constantsPromise ??= (async () => {
    const buffer = await readFile(path.join(process.cwd(), 'src/data/captcha-weights.bin'));
    const tensors = new Map<number, tf.Tensor>();
    for (const c of manifest.constants) {
      const slice = buffer.subarray(c.offset, c.offset + c.length);
      const copy = Uint8Array.from(slice);
      const values =
        c.dtype === 'float32' ? new Float32Array(copy.buffer) : new Int32Array(copy.buffer);
      tensors.set(c.index, tf.tensor(values, c.shape, c.dtype as 'float32' | 'int32'));
    }
    return tensors;
  })());
}
function activation(tensor: tf.Tensor, kind: number) {
  if (kind === 0) return tensor;
  if (kind === 1) return tf.relu(tensor);
  if (kind === 3) return tf.clipByValue(tensor, 0, 6);
  throw Error('Unsupported model activation.');
}
export async function predictCharacters(pixels: Float32Array) {
  const base = await constants();
  return tf.tidy(() => {
    const tensors = new Map(base);
    tensors.set(manifest.input, tf.tensor4d(pixels, [1, 25, 120, 1]));
    for (const op of manifest.operations) {
      const inputs = op.inputs.map((i) => tensors.get(i)!);
      const options = op.options as Record<string, number>;
      const values = (i: number) => Array.from(inputs[i].dataSync());
      let output: tf.Tensor;
      switch (op.name) {
        case 'CONV_2D': {
          const filters = tf.transpose(inputs[1], [1, 2, 3, 0]) as tf.Tensor4D;
          output = activation(
            tf.add(
              tf.conv2d(
                inputs[0] as tf.Tensor4D,
                filters,
                [options.strideH, options.strideW],
                options.padding === 0 ? 'same' : 'valid',
                'NHWC',
                [options.dilationH, options.dilationW],
              ),
              inputs[2],
            ),
            options.activation,
          );
          break;
        }
        case 'MAX_POOL_2D':
          output = tf.maxPool(
            inputs[0] as tf.Tensor4D,
            [options.filterH, options.filterW],
            [options.strideH, options.strideW],
            options.padding === 0 ? 'same' : 'valid',
          );
          break;
        case 'AVERAGE_POOL_2D':
          output = tf.avgPool(
            inputs[0] as tf.Tensor4D,
            [options.filterH, options.filterW],
            [options.strideH, options.strideW],
            options.padding === 0 ? 'same' : 'valid',
          );
          break;
        case 'PAD':
          output = tf.pad(inputs[0], inputs[1].arraySync() as [number, number][]);
          break;
        case 'STRIDED_SLICE':
          output = tf.stridedSlice(
            inputs[0],
            values(1),
            values(2),
            values(3),
            options.beginMask,
            options.endMask,
            options.ellipsisMask,
            options.newAxisMask,
            options.shrinkAxisMask,
          );
          break;
        case 'SHAPE':
          output = tf.tensor1d(inputs[0].shape, 'int32');
          break;
        case 'SLICE':
          output = tf.slice(inputs[0], values(1), values(2));
          break;
        case 'CONCATENATION':
          output = tf.concat(inputs, options.axis);
          break;
        case 'TRANSPOSE':
          output = tf.transpose(inputs[0], values(1));
          break;
        case 'CAST':
          output = tf.cast(inputs[0], 'int32');
          break;
        case 'RESHAPE':
          output = tf.reshape(inputs[0], values(1));
          break;
        case 'PACK':
          output = tf.stack(inputs, options.axis);
          break;
        case 'FULLY_CONNECTED':
          output = activation(
            tf.add(
              tf.matMul(inputs[0] as tf.Tensor2D, inputs[1] as tf.Tensor2D, false, true),
              inputs[2],
            ),
            options.activation,
          );
          break;
        default:
          throw Error('Unsupported model operation: ' + op.name);
      }
      tensors.set(op.output, output);
    }
    const output = tensors.get(manifest.output)!.dataSync();
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
    let result = '';
    for (let i = 0; i < 5; i++) {
      let best = 0;
      for (let c = 1; c < 37; c++) if (output[i * 37 + c] > output[i * 37 + best]) best = c;
      result += chars[best];
    }
    return result.replaceAll('_', '');
  });
}
export async function suggestCaptcha(bytes: Buffer): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const { data } = await sharp(bytes)
      .extract({ left: 0, top: 0, width: 120, height: 25 })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return (await predictCharacters(Float32Array.from(data, (v) => v / 255))) || null;
  } catch {
    return null;
  }
}
