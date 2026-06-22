FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    CUDA_HOME=/usr/local/cuda \
    PATH=/usr/local/cuda/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    LD_LIBRARY_PATH=/usr/local/cuda/lib64 \
    TORCH_CUDA_ARCH_LIST="8.0;8.6;8.9;9.0" \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    FACELIFT_DIR=/opt/FaceLift

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ffmpeg \
    git \
    libgl1 \
    libglib2.0-0 \
    ninja-build \
    python3 \
    python3-dev \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --upgrade pip wheel setuptools

RUN python3 -m pip install \
    torch==2.4.0 \
    torchvision==0.19.0 \
    --index-url https://download.pytorch.org/whl/cu124

COPY requirements.txt /tmp/facelift-scan-requirements.txt
RUN python3 -m pip install -r /tmp/facelift-scan-requirements.txt

RUN python3 -m pip install facenet-pytorch --no-deps && \
    python3 -m pip install git+https://github.com/graphdeco-inria/diff-gaussian-rasterization --no-build-isolation

RUN git clone --depth=1 https://github.com/weijielyu/FaceLift "${FACELIFT_DIR}"

WORKDIR /app
COPY patched_inference.py ${FACELIFT_DIR}/inference.py
COPY render_gaussians.py /opt/render_gaussians.py
COPY prefetch_weights.py /app/prefetch_weights.py
RUN python3 /app/prefetch_weights.py

COPY aura_scripts /app/aura_scripts
COPY app.py /app/app.py

EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
