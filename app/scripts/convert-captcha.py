"""Convert the owner's fixed TFLite model to a portable TFJS operation manifest.
Run with Python packages `tflite` and `numpy`. Not needed for normal app installs.
"""
from pathlib import Path
import json
import numpy as np
import tflite

root = Path(__file__).resolve().parents[1] / 'src' / 'data'
model = tflite.Model.GetRootAsModel((root / 'captcha.tflite').read_bytes(), 0)
graph = model.Subgraphs(0)
operator_names = {v: k for k, v in vars(tflite.BuiltinOperator).items() if isinstance(v, int)}
type_map = {tflite.TensorType.FLOAT32: np.float32, tflite.TensorType.INT32: np.int32, tflite.TensorType.INT64: np.int64}
constants = []
blob = bytearray()
for index in range(graph.TensorsLength()):
    tensor = graph.Tensors(index)
    buffer = model.Buffers(tensor.Buffer())
    if buffer.DataLength() == 0:
        continue
    values = np.frombuffer(buffer.DataAsNumpy().tobytes(), dtype=type_map[tensor.Type()])
    dtype = 'float32' if tensor.Type() == tflite.TensorType.FLOAT32 else 'int32'
    values = values.astype(np.float32 if dtype == 'float32' else np.int32)
    data = values.tobytes()
    constants.append(dict(index=index, shape=tensor.ShapeAsNumpy().tolist(), dtype=dtype, offset=len(blob), length=len(data)))
    blob.extend(data)
operations = []
for index in range(graph.OperatorsLength()):
    op = graph.Operators(index)
    name = operator_names[model.OperatorCodes(op.OpcodeIndex()).BuiltinCode()]
    options = {}
    if name == 'CONV_2D':
        target = tflite.Conv2DOptions()
        target.Init(op.BuiltinOptions().Bytes, op.BuiltinOptions().Pos)
        options = dict(padding=target.Padding(), strideH=target.StrideH(), strideW=target.StrideW(), dilationH=target.DilationHFactor(), dilationW=target.DilationWFactor(), activation=target.FusedActivationFunction())
    elif name in ['MAX_POOL_2D', 'AVERAGE_POOL_2D']:
        target = tflite.Pool2DOptions()
        target.Init(op.BuiltinOptions().Bytes, op.BuiltinOptions().Pos)
        options = dict(padding=target.Padding(), strideH=target.StrideH(), strideW=target.StrideW(), filterH=target.FilterHeight(), filterW=target.FilterWidth(), activation=target.FusedActivationFunction())
    elif name == 'STRIDED_SLICE':
        target = tflite.StridedSliceOptions()
        target.Init(op.BuiltinOptions().Bytes, op.BuiltinOptions().Pos)
        options = dict(beginMask=target.BeginMask(), endMask=target.EndMask(), ellipsisMask=target.EllipsisMask(), newAxisMask=target.NewAxisMask(), shrinkAxisMask=target.ShrinkAxisMask())
    elif name == 'CONCATENATION':
        target = tflite.ConcatenationOptions(); target.Init(op.BuiltinOptions().Bytes, op.BuiltinOptions().Pos)
        options = dict(axis=target.Axis())
    elif name == 'PACK':
        target = tflite.PackOptions(); target.Init(op.BuiltinOptions().Bytes, op.BuiltinOptions().Pos)
        options = dict(axis=target.Axis())
    elif name == 'FULLY_CONNECTED':
        target = tflite.FullyConnectedOptions(); target.Init(op.BuiltinOptions().Bytes, op.BuiltinOptions().Pos)
        options = dict(activation=target.FusedActivationFunction())
    operations.append(dict(name=name, inputs=op.InputsAsNumpy().tolist(), output=int(op.Outputs(0)), options=options))
manifest = dict(input=int(graph.Inputs(0)), output=int(graph.Outputs(0)), constants=constants, operations=operations)
(root / 'captcha-weights.bin').write_bytes(blob)
(root / 'captcha-model.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Converted', len(operations), 'operations;', len(blob), 'weight bytes')
