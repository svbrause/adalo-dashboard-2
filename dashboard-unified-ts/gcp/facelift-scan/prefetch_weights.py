from __future__ import annotations

import os
import sys
import urllib.request

FACELIFT_DIR = os.environ.get("FACELIFT_DIR", "/opt/FaceLift")


def main() -> None:
    os.chdir(FACELIFT_DIR)
    sys.path.insert(0, FACELIFT_DIR)

    import inference

    inference.download_weights_from_hf()

    vgg_dst = "/root/.cache/openfacelift/imagenet-vgg-verydeep-19.mat"
    os.makedirs(os.path.dirname(vgg_dst), exist_ok=True)
    if not os.path.exists(vgg_dst):
        urllib.request.urlretrieve(
            "https://www.vlfeat.org/matconvnet/models/imagenet-vgg-verydeep-19.mat",
            vgg_dst,
        )

    from rembg import new_session

    new_session("u2net")


if __name__ == "__main__":
    main()
