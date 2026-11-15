# Format references and credits

## UVtools

Thanks to **sn4k3 and the UVtools contributors** for documenting and implementing
resin printing formats: https://github.com/sn4k3/UVtools.

3-IG's independent browser-side Anycubic metadata readers use file-layout facts,
field meanings, version identifiers and extension coverage researched from:

- `UVtools.Core/FileFormats/AnycubicFile.cs`
- `UVtools.Core/FileFormats/AnycubicZipFile.cs`
- `UVtools.Core/FileFormats/AnycubicPhotonSFile.cs`
- `UVtools.Core/FileFormats/ChituboxFile.cs`

Reference revision:
[`2e3bad68174b9d5da06148a3b2d5d5220586f7a5`](https://github.com/sn4k3/UVtools/tree/2e3bad68174b9d5da06148a3b2d5d5220586f7a5).
Coverage is pinned to this revision, not a promise to support future formats.

UVtools is licensed under the
[GNU Affero General Public License v3.0](https://github.com/sn4k3/UVtools/blob/2e3bad68174b9d5da06148a3b2d5d5220586f7a5/LICENSE).
UVtools' .NET engine, C# source and image decoders are not bundled or executed by
3-IG. These readers extract metadata; they are not a browser port of UVtools.
Use UVtools itself when you need its full inspection, conversion or repair tools.
No affiliation or endorsement is implied.

## Other format references

- PrusaSlicer SL1/SL1S configuration metadata.
- [Elegoo's official GOO specification](https://github.com/elegooOfficial/GOO).
- [cbiffle/catibo CTB/CBDDLP format documentation](https://github.com/cbiffle/catibo/blob/master/doc/cbddlp-ctb.adoc).
