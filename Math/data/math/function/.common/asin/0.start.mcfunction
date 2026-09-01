data modify storage math:internal w_inverse_trigonometry_input set from storage math:internal x
execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run data modify storage math:internal x set compute default float math:.common/inverse_trigonometry/half_pi
execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run data modify storage math:internal x set compute default float math:.common/rounding/negate
execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run return 1
execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run data modify storage math:internal x set from storage math:internal w_inverse_trigonometry_input
execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run data modify storage math:internal x set compute default float math:.common/input/x
execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run return 1
execute if data storage math:internal {w_inverse_trigonometry_input:1.0f} run data modify storage math:internal x set compute default float math:.common/inverse_trigonometry/half_pi
execute if data storage math:internal {w_inverse_trigonometry_input:1.0f} run return 1
data modify storage math:internal w_comparison.predicate.inverse_trigonometry_x_negative set compute default float math:internal/comparison/predicate/inverse_trigonometry/x_negative/value
execute if predicate math:internal/inverse_trigonometry/x_negative run data modify storage math:internal x set compute default float math:.common/rounding/negate
data modify storage math:internal w_comparison.predicate.inverse_trigonometry_use_complement set compute default float math:internal/comparison/predicate/inverse_trigonometry/use_complement/value
execute if predicate math:internal/inverse_trigonometry/use_complement run data modify storage math:internal w_inverse_trigonometry_square_target set compute default float math:.common/inverse_trigonometry/complement
execute if predicate math:internal/inverse_trigonometry/use_complement run function math:.common/inverse_trigonometry/0.start
execute if predicate math:internal/inverse_trigonometry/use_complement run function math:.common/asin_positive/0.start
execute if predicate math:internal/inverse_trigonometry/use_complement run data modify storage math:internal w_inverse_trigonometry_half_pi set compute default float math:.common/inverse_trigonometry/half_pi
execute if predicate math:internal/inverse_trigonometry/use_complement run data modify storage math:internal x set compute default float math:.common/inverse_trigonometry/acos
execute unless predicate math:internal/inverse_trigonometry/use_complement run function math:.common/asin_positive/0.start
execute if predicate math:internal/inverse_trigonometry/x_negative run data modify storage math:internal x set compute default float math:.common/rounding/negate
return 1
