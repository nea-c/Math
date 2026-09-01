data modify storage math:internal w_atan_square set compute default float math:common/atan/square
data modify storage math:internal x set compute default float math:common/atan/polynomial
execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal x set compute default float math:common/atan/after_pi_four
execute if predicate math:internal/atan/use_reciprocal run data modify storage math:internal x set compute default float math:common/atan/after_reciprocal
execute if predicate math:internal/atan/x_negative run data modify storage math:internal x set compute default float math:common/rounding/negate
return 1
