The files in `vendor/` are unmodified excerpts from [SemLayoutDiff](https://github.com/3dlg-hcvc/SemLayoutDiff), commit `6b12bc4c42aa8377445af108093539073f0495c1`, under the accompanying MIT license. `vendor/upstream.json` records their SHA-256 hashes.

RealRoom's adapter uses the official SLDN network, its conditioned reverse diffusion steps, and the official APM network with the published checkpoints. It does not use the dataset loader, scene exporter, training scripts, or 3D-FUTURE meshes. It retrieves RealRoom products without rescaling them. The adapter samples only the final diffusion state instead of retaining the full chain.

The code license does not establish a license for every training asset or checkpoint. The Hugging Face dataset repository currently has no model/dataset card declaring checkpoint licensing. Commercial release still requires clarification of those terms; this integration is an experimental evaluation path.
