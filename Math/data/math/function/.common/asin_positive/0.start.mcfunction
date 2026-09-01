data modify storage math: internal.w_asin_target set from storage math: internal.x
data modify storage math: internal.w_asin_low set value 0.0f
data modify storage math: internal.w_asin_high set compute default float math:.common/asin_positive/half_pi
function math:.common/asin_positive/1.solve
data modify storage math: internal.x set compute default float math:.common/asin_positive/midpoint
return 1
