data modify storage math:internal y set compute default float math:.common/rounding/half_y
data modify storage math:internal w_comparison.predicate.rounding_remainder_can_subtract_y set compute default float math:internal/comparison/predicate/rounding/remainder/can_subtract_y/value
execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default float math:.common/sub
data modify storage math:internal y set compute default float math:.common/rounding/half_y
data modify storage math:internal w_comparison.predicate.rounding_remainder_can_subtract_y set compute default float math:internal/comparison/predicate/rounding/remainder/can_subtract_y/value
execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default float math:.common/sub
return 1
