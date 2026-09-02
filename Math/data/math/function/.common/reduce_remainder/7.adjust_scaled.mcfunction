data modify storage math: internal.w_remainder_scaled_divisor set compute default float math:.common/reduce_remainder/half_scaled_divisor
data modify storage math: internal.w_remainder_shift set compute default float {"type":"add","inputs":[{"type":"storage","storage":"math:","path":"internal.w_remainder_shift"},-1]}
