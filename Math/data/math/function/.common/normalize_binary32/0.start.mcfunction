data modify storage math: internal.w_normalize_exponent set compute default float math:.common/normalize/binary32/exponent
data modify storage math: internal.z set from storage math: internal.w_normalize_exponent
data modify storage math: internal.w_normalize_scale set compute default float math:exp/scale/00
data modify storage math: internal.w_normalize_multiplier_a set compute default float math:.common/normalize/binary32/multiplier_a
data modify storage math: internal.w_normalize_multiplier_b set compute default float math:.common/normalize/binary32/multiplier_b
data modify storage math: internal.w_normalize_mantissa set compute default float math:.common/normalize/binary32/mantissa_a
data modify storage math: internal.w_normalize_mantissa set compute default float math:.common/normalize/binary32/mantissa_b
return 1
