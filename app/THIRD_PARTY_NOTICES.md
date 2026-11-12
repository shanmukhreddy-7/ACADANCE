# Reference and attribution

University field mappings, integration behavior, the faculty cabin directory, the 2026–27 academic calendar and the original CAPTCHA model are adapted from [StoreVia/Srmap-Api](https://github.com/StoreVia/Srmap-Api). Reuse is based on permission from its owners as confirmed by the requester. Reference revision: `6f174f8e351cf9e1cf57a2e56e6d2ed4f1a73257` (reviewed 6 November 2026).

`src/data/captcha.tflite` is the reference model. `scripts/convert-captcha.py` converts its constant tensors and graph into `captcha-model.json` and `captcha-weights.bin`. The server executes that graph with TensorFlow.js CPU operations, avoiding the reference runtime's native build dependency. The model's crop, normalization and alphabet are preserved. Verification runs inside the credentials-only server sign-in flow; prediction success is not a guarantee of university acceptance.

Acadence has its own UI, C++ academic engine, professor demo, encrypted storage, consent controls and session design. The reference project's private databases, user records, credentials, cloud buckets, branding and app-store binaries are not included. Installed npm dependencies retain their respective package licenses.

University records belong to their respective users and institution. Acadence is an independent project, not an official SRM AP portal.
