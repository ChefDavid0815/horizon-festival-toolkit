# ForzaCryptoTool dependency

The application expects the official **ForzaCryptoTool V3.2** executable at `tools/ForzaCryptoTool.exe` for encrypted-save operations. The executable is excluded from Git; application source and integration code are included.

Download it from the [upstream V3.2 release](https://github.com/DVS-code/Forza-Crypto-Tool/releases/tag/V3.2). The exact Windows asset is [ForzaCryptoTool.exe](https://github.com/DVS-code/Forza-Crypto-Tool/releases/download/V3.2/ForzaCryptoTool.exe).

Expected SHA-256:

```text
4b08e2f42e581281c0409009f8ea53f828a0a23e6633d0b79cdc7585ca705212
```

Verify locally with `Get-FileHash .\tools\ForzaCryptoTool.exe -Algorithm SHA256`. The backend also checks this digest before encrypted-save operations. Review the upstream project and its terms; third-party binaries do not inherit any licence from this repository.

加密存档操作需要上述官方 V3.2 程序，放入 `tools/ForzaCryptoTool.exe`。二进制文件不进入 Git 历史。先核对 SHA-256；后端也会验证。加解密由 `forzamods.dev` 在线处理，会传送所选的存档文件。仅构建界面与运行无需私人样本的核心测试时不需要此工具。
