# Hosted Python kernel for Labda Protocols (ADR-0027).
#
# Runs the Jupyter Kernel Gateway — the REST + WebSocket kernel API the
# in-browser JupyterKernel client speaks (POST /api/kernels, channels WS). No
# notebook UI; just kernels.
#
# Deploy on Railway/Fly/any container host. The browser connects directly, so
# CORS must allow the UI origin. Auth is a token (KG_AUTH_TOKEN).
FROM python:3.12-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1

# The kernel gateway + a kernel + the common scientific stack Protocols use.
RUN pip install \
      jupyter_kernel_gateway==3.0.1 \
      ipykernel \
      numpy pandas matplotlib scipy

# Non-root.
RUN useradd -m runner
USER runner
WORKDIR /home/runner

# Railway/Fly set $PORT. allow_origin is the UI origin (set ALLOW_ORIGIN);
# auth_token gates access (set KG_AUTH_TOKEN). allow_credentials + headers let
# the browser send the token.
ENV PORT=8888 \
    ALLOW_ORIGIN="*" \
    KG_AUTH_TOKEN=""

CMD jupyter kernelgateway \
      --KernelGatewayApp.ip=0.0.0.0 \
      --KernelGatewayApp.port=${PORT} \
      --KernelGatewayApp.allow_origin="${ALLOW_ORIGIN}" \
      --KernelGatewayApp.auth_token="${KG_AUTH_TOKEN}" \
      --JupyterWebsocketPersonality.list_kernels=True
