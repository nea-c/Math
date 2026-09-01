data modify storage math: internal.w set compute default float math:.common/rounding/double_y
data modify storage math: internal.y set from storage math: internal.w
return run function math:.common/reduce_remainder/2.shallow_one
