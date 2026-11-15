# 3-IG - 3D print invoicing

Price filament/resin printing and modelling services, then generate customer invoices. No account or installation is required.

**[Open 3-IG](https://crispybuttermilkchickensalad.github.io/3dp-invoice-generator/)** | **[Full feature guide and documentation](https://github.com/CrispyButtermilkChickenSalad/3dp-invoice-generator/wiki)**

## Run locally

Install Python 3, clone this repository, then run:

```powershell
git clone https://github.com/CrispyButtermilkChickenSalad/3dp-invoice-generator.git
cd 3dp-invoice-generator
py -3 serve.py
```

Open `http://127.0.0.1:4173` in a modern browser. On macOS/Linux, use `python3 serve.py`. No Node.js, build step or additional packages are needed.

## Basic use

1. Set your studio details and currency in **Studio settings**.
2. Add your printers and materials, including their actual operating costs.
3. Choose **New project**, upload G-code or supported resin files (Photon Workshop/Anycubic, SL1/SL1S, GOO V3.0, standard CTB v2/v3), or enter slicer metrics manually. Assign each plate to a printer and material.
4. Set labour/pricing, optionally add **3D modelling**, then select or enter the customer.
5. Choose invoice sections, preview, and **Print / Save PDF** or **Export CSV**.

Data stays in this browser; **Data & backups** exports/imports JSON to transfer it between devices or local hosting and Pages. Keep backups before clearing browser data. Currency selection does not convert prices.

See the [wiki](https://github.com/CrispyButtermilkChickenSalad/3dp-invoice-generator/wiki) for all features, calculations, supported imports, limitations, backups, hosting and verification.

Anycubic format research credits **sn4k3 and the UVtools contributors**. See [format references and notices](THIRD_PARTY_NOTICES.md).
