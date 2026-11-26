#!/bin/bash
# SSH ke Alienware lewat proxy CONNECT (pola alienware-ssh/proxy.py)
ssh -o ProxyCommand="python3 $HOME/workspace/alienware-ssh/proxy.py 100.68.164.32 22" \
    -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25 \
    -i ~/.ssh/id_ed25519 alienware@100.68.164.32 "$@"
