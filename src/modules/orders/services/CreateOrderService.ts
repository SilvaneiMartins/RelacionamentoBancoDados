import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);
    if (!findCustomer) {
      throw new AppError('This Customer does not Exist');
    }

    const onlyProductsId = products.map(product => ({ id: product.id }));
    const productsIds = await this.productsRepository.findAllById(
      onlyProductsId,
    );
    if (productsIds.length !== products.length) {
      throw new AppError('One or more products was not found');
    }

    const updatedQuantitiesOfProducts: IUpdateProductsQuantityDTO[] = [];
    const updatingProducts = productsIds.map(productId => {
      const orderProduct = products.find(
        product => product.id === productId.id,
      );

      if (orderProduct) {
        if (productId.quantity < orderProduct.quantity) {
          throw new AppError(
            `There isn't so many of ${productId.name} in the stock`,
          );
        }

        updatedQuantitiesOfProducts.push({
          id: productId.id,
          quantity: productId.quantity - orderProduct.quantity,
        });

        return {
          ...productId,
          quantity: orderProduct.quantity,
        };
      }
      return productId;
    });

    await this.productsRepository.updateQuantity(updatedQuantitiesOfProducts);
    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: updatingProducts.map(product => ({
        product_id: product.id,
        price: product.price,
        quantity: product.quantity,
      })),
    });
    return order;
  }
}

export default CreateProductService;
