# Architectural context only

The official [gVisor architecture guide](https://gvisor.dev/docs/architecture_guide/intro/)
describes a userspace application kernel that mediates workload system calls rather
than treating the host kernel as the workload's direct system-call implementation.
This supports the boundary explanation (S31), not a project finding about escape
prevention. Retrieved 2026-11-09. No vendor effectiveness claim is adopted as
experimental evidence. All project measurements remain the frozen Phase 4 records.
