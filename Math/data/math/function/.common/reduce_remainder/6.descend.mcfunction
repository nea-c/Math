data modify storage math: internal.w_comparison.predicate.rounding_remainder_can_subtract_y set compute default float math:.validation/predicate/rounding/remainder/can_subtract_y/value
execute if predicate math:.validation/rounding/remainder/can_subtract_y run data modify storage math: internal.x set compute default float math:.common/sub
execute unless predicate math:.validation/rounding/remainder/shift_positive run return 1
data modify storage math: internal.y set compute default float math:.common/rounding/half_y
data modify storage math: internal.w_remainder_remaining_shift set compute default float math:.common/reduce_remainder/decrement_remaining_shift
return run function math:.common/reduce_remainder/6.descend
