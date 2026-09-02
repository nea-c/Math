data modify storage math: internal.w_inverse_trigonometry_input set from storage math: internal.x
execute if data storage math: {internal:{w_inverse_trigonometry_input:-1.0f}} run return run function math:.common/asin/1.negative_one
execute if data storage math: {internal:{w_inverse_trigonometry_input:0.0f}} run return 1
execute if data storage math: {internal:{w_inverse_trigonometry_input:1.0f}} run return run data modify storage math: internal.x set compute default float math:.common/inverse_trigonometry/half_pi
data modify storage math: internal.w_comparison.predicate.inverse_trigonometry_x_negative set compute default float math:.validation/predicate/inverse_trigonometry/x_negative/value
execute if predicate math:.validation/inverse_trigonometry/x_negative run data modify storage math: internal.x set compute default float math:.common/rounding/negate
data modify storage math: internal.w_comparison.predicate.inverse_trigonometry_use_complement set compute default float math:.validation/predicate/inverse_trigonometry/use_complement/value
execute if predicate math:.validation/inverse_trigonometry/use_complement run function math:.common/asin/2.complement
execute unless predicate math:.validation/inverse_trigonometry/use_complement run function math:.common/asin_positive/0.start
execute if predicate math:.validation/inverse_trigonometry/x_negative run data modify storage math: internal.x set compute default float math:.common/rounding/negate
return 1
